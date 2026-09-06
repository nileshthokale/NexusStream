// Convert SRT subtitle text to WebVTT so the browser's native <track> can use it
export const srtToVtt = (srt) => {
  const body = srt
    .replace(/\r+/g, '')
    .replace(/^\uFEFF/, '')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2') // commas → dots in timestamps
    .trim();
  return `WEBVTT\n\n${body}\n`;
};

export const isSubtitleFile = (name) => /\.(srt|vtt)$/i.test(name);

// Build a blob URL for a subtitle File, converting SRT on the fly
export const subtitleBlobUrl = async (file) => {
  const text = await file.text();
  const vtt = file.name.toLowerCase().endsWith('.vtt') ? text : srtToVtt(text);
  return URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
};

export const formatSrtTime = (seconds) => {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(Math.floor(seconds % 60)).padStart(2, '0');
  return `${h}:${m}:${s},000`;
};
