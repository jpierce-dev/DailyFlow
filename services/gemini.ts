import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ScriptData, VocabularyItem } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// CACHE LOGIC: Load from localStorage on init
const CACHE_KEY_PREFIX = 'dailyflow_def_';
const definitionCache = new Map<string, VocabularyItem>();

try {
    // Hydrate cache from localStorage (optional: limit size if needed)
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith(CACHE_KEY_PREFIX)) {
            try {
                const val = JSON.parse(localStorage.getItem(key) || '');
                // Clean key to get cacheKey
                const cacheKey = key.replace(CACHE_KEY_PREFIX, '');
                definitionCache.set(cacheKey, val);
            } catch (e) {
                // Ignore malformed entries
            }
        }
    });
} catch (e) {
    console.warn("Could not access localStorage for cache hydration");
}

// Helper to decode base64 audio
const decodeAudioData = async (base64String: string, audioContext: AudioContext): Promise<AudioBuffer> => {
  const binaryString = atob(base64String);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return await audioContext.decodeAudioData(bytes.buffer);
};

// A diverse list of scenarios to prevent repetitive content
const SCENARIOS = [
  "A misunderstanding between friends about a text message",
  "Negotiating a lower price at a garage sale",
  "Tech support trying to help a very confused user",
  "Two people discussing a vivid and weird dream",
  "A job interview for a very unusual or funny role",
  "Complaining about a noisy neighbor to the landlord",
  "Planning a surprise party that is already going wrong",
  "Returning a used item to a strict store clerk",
  "A first date that is becoming slightly awkward",
  "Asking for a big favor from a reluctant friend",
  "Debating a trivial topic intensely (e.g., does pineapple belong on pizza)",
  "Getting lost in a city with 1% phone battery",
  "Witnessing something strange on the subway",
  "Trying to assemble complicated furniture together",
  "Gossiping about a coworker's new haircut",
  "Explaining a modern internet meme to an older relative",
  "A customer with impossible dietary requirements at a restaurant",
  "Two astronauts discussing lunch in space",
  "A detective questioning a witness about a missing cat",
  "Trying to split a bill seven ways at a restaurant"
];

export const generateDailyScript = async (difficulty: string): Promise<ScriptData> => {
  // Use gemini-3-flash-preview as requested
  const modelId = "gemini-3-flash-preview";
  
  // Select a random scenario to ensure variety
  const randomScenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];

  const prompt = `
    Generate a short, unique, and natural English dialogue scene for listening practice.
    
    Target Level: ${difficulty}
    Topic: ${randomScenario}
    
    Constraints:
    1. Characters: 2 distinct personalities (e.g., Anxious vs Calm, Grumpy vs Cheerful). Give them names.
    2. Style: Real, candid, and authentic. Avoid robotic "textbook" English. Use idioms, contractions, natural interruptions, or slang where appropriate for the context and selected difficulty level.
       - Beginner: Simple sentences, common vocabulary, slower pacing.
       - Intermediate: Mixed tenses, some idioms, natural flow.
       - Advanced: Complex sentence structures, fast-paced banter, nuanced vocabulary, abstract topics.
    3. Length: 6-10 lines only.
    4. Output: JSON.
    
    Schema:
    - title: string (Engaging title)
    - context: string (1 sentence setup)
    - difficulty: string (The requested level: ${difficulty})
    - lines: array of {
        id: number,
        speaker: string,
        english: string,
        chinese: string,
        sentiment: string
      }
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        temperature: 1.1, // Higher temperature for more creative/varied outputs
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            context: { type: Type.STRING },
            difficulty: { type: Type.STRING },
            lines: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER },
                  speaker: { type: Type.STRING },
                  english: { type: Type.STRING },
                  chinese: { type: Type.STRING },
                  sentiment: { type: Type.STRING },
                },
                required: ["id", "speaker", "english", "chinese", "sentiment"]
              }
            }
          },
          required: ["title", "context", "difficulty", "lines"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No script generated");
    
    // Clean potential markdown fences just in case
    const cleanText = text.replace(/```json\n?|\n?```/g, "").trim();
    
    const data = JSON.parse(cleanText) as ScriptData;

    if (!data.lines || !Array.isArray(data.lines)) {
      throw new Error("Generated script format is invalid.");
    }

    return data;

  } catch (error) {
    console.error("Script generation failed:", error);
    throw error;
  }
};

export const generateAudioFromScript = async (lines: { speaker: string; english: string }[]): Promise<string> => {
  if (!lines || !Array.isArray(lines) || lines.length === 0) {
    throw new Error("Invalid dialogue lines.");
  }

  // 1. Identify Speakers
  const uniqueSpeakers = Array.from(new Set(lines.map(l => l.speaker)));
  
  // 2. Map Script to Speaker Aliases (SpeakerOne / SpeakerTwo)
  // Removing spaces to avoid potential 500 errors from strict parsing on the backend
  const speakerMap = new Map<string, string>();
  
  uniqueSpeakers.forEach((name, index) => {
    speakerMap.set(name, index % 2 === 0 ? 'SpeakerOne' : 'SpeakerTwo');
  });

  const fullText = lines.map(l => {
    const alias = speakerMap.get(l.speaker) || 'SpeakerOne'; 
    return `${alias}: ${l.english}`;
  }).join('\n');

  // 3. Assign Voices
  // SpeakerOne gets a deep male voice (Fenrir)
  // SpeakerTwo gets a soft female voice (Kore)
  const speakerConfigs = [
    {
      speaker: 'SpeakerOne',
      voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } }
    },
    {
      speaker: 'SpeakerTwo',
      voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
    }
  ];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: fullText }] }],
      config: {
        responseModalities: ['AUDIO'], // Using string literal as per some examples to be safe
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: speakerConfigs
          }
        }
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio generated from multi-speaker model");

    return base64Audio; 

  } catch (error: any) {
    console.warn("Multi-speaker Audio generation failed, attempting fallback to single speaker:", error);
    
    // Optimization: If it's a quota error (429), do not attempt fallback, just throw.
    if (error.message?.includes('429') || error.status === 429 || error.toString().includes('RESOURCE_EXHAUSTED')) {
         throw error;
    }
    
    // Fallback: Single Speaker
    // Concatenate text with pauses naturally
    const simpleText = lines.map(l => l.english).join('. ');
    
    try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: simpleText }] }],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Kore' }
                }
            }
          }
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) throw new Error("No audio generated from fallback model");
        return base64Audio;
        
    } catch (fallbackError) {
        console.error("Fallback Audio generation failed:", fallbackError);
        throw fallbackError;
    }
  }
};

export const getWordDefinition = async (word: string, contextSentence: string): Promise<VocabularyItem> => {
   // Check cache first
   // We use a simplified key to increase cache hit rate for same words
   // but still include a bit of context if the definition relies heavily on it.
   // For now, let's cache by WORD only for better performance across sessions, 
   // unless strict context is needed.
   const cacheKey = `${word.toLowerCase()}`;
   
   if (definitionCache.has(cacheKey)) {
       return definitionCache.get(cacheKey)!;
   }

   // Use gemini-3-flash-preview as requested for speed
   const modelId = "gemini-3-flash-preview";
   const prompt = `Define "${word}" in context of: "${contextSentence}". Return a concise English definition, a Chinese definition, and a short example.`;
   
   const response = await ai.models.generateContent({
     model: modelId,
     contents: prompt,
     config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                word: { type: Type.STRING },
                definitionEn: { type: Type.STRING, description: "Concise English definition" },
                definitionCn: { type: Type.STRING, description: "Chinese meaning/definition" },
                example: { type: Type.STRING }
            },
            required: ["word", "definitionEn", "definitionCn", "example"]
        }
     }
   });

   const text = response.text || '{}';
   const cleanText = text.replace(/```json\n?|\n?```/g, "").trim();
   
   const result = JSON.parse(cleanText) as VocabularyItem;
   
   // Update Memory Cache
   definitionCache.set(cacheKey, result);
   
   // Update Persistent Cache (LocalStorage)
   try {
       localStorage.setItem(CACHE_KEY_PREFIX + cacheKey, JSON.stringify(result));
   } catch (e) {
       console.warn("LocalStorage full or unavailable");
   }
   
   return result;
}