export { generateLowerThirdClip } from "./lowerThird.js";
export type { LowerThirdSpec } from "./lowerThird.js";

export interface MotionGraphicsGenerator {
  readonly name: string;
  generate(spec: unknown): Promise<string>;
}
