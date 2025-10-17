// open camera
export async function openCamera(videoEl) {
  if (!videoEl) throw new Error('Video element is required');
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera API is not supported in this browser');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user' },
    audio: true,
  });
  videoEl.srcObject = stream;
  await videoEl.play().catch(() => {});
  return stream;
}

// stop stream
export function stopStream(stream, videoEl) {
  if (stream) stream.getTracks().forEach((t) => t.stop());
  if (videoEl && videoEl.srcObject) videoEl.srcObject = null;
}
