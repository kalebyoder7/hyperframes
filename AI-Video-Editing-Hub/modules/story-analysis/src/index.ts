export { detectSceneBoundaries } from "./sceneDetection.js";
export type { SceneDetectionOptions } from "./sceneDetection.js";

export { NoOpSpeakerDetector } from "./speakerDetection.js";
export type { SpeakerDetector } from "./speakerDetection.js";

export {
  AnthropicStoryAnalyzer,
  StoryAnalysisError,
  buildPrompt,
  parseAnalysisResponse,
} from "./narrativeAnalysis.js";
export type { StoryAnalysisResult, AnthropicStoryAnalyzerOptions } from "./narrativeAnalysis.js";
