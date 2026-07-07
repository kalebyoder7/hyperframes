export interface FfprobeStream {
  codec_type: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  avg_frame_rate?: string;
}

export interface FfprobeFormat {
  duration?: string;
  format_name?: string;
}

export interface FfprobeOutput {
  streams: FfprobeStream[];
  format: FfprobeFormat;
}
