
/**
 * Utility for speech synthesis with a preference for a female voice.
 */
export function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported in this browser.');
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  
  const setVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    
    // Attempt to find a high-quality female voice
    const femaleVoice = voices.find(v => 
      v.name.toLowerCase().includes('female') || 
      v.name.toLowerCase().includes('woman') ||
      v.name.toLowerCase().includes('google uk english female') ||
      v.name.toLowerCase().includes('samantha') ||
      v.name.toLowerCase().includes('victoria') ||
      v.name.toLowerCase().includes('siri')
    );

    if (femaleVoice) {
      utterance.voice = femaleVoice;
    } else {
      // Fallback: Use a slightly higher pitch if no specific female voice found
      utterance.pitch = 1.2;
    }

    utterance.rate = 1.0;
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  // getVoices() is populated asynchronously
  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = setVoice;
  } else {
    setVoice();
  }
}
