import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFileCb);

export interface ExecResult {
  stdout: string;
  stderr: string;
}

export type ExecFn = (command: string, args: string[]) => Promise<ExecResult>;

// Thin, injectable wrapper around child_process.execFile so callers (e.g. the
// rendering and audio modules) can be unit-tested without spawning real
// binaries like ffmpeg/ffprobe.
export const realExec: ExecFn = async (command, args) => {
  const { stdout, stderr } = await execFileAsync(command, args, {
    maxBuffer: 1024 * 1024 * 64,
  });
  return { stdout, stderr };
};

export async function isBinaryAvailable(
  command: string,
  exec: ExecFn = realExec,
): Promise<boolean> {
  try {
    await exec(command, ["-version"]);
    return true;
  } catch {
    return false;
  }
}
