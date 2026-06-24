export interface AndroidModel {
  name: string;
  path: string;
  sizeBytes: number;
}

export interface AndroidBridgeInterface {
  setStorageDirectory: () => void;
  getAvailableModels: () => string; // Returns JSON string of AndroidModel[]
  downloadModel: (customUrl: string, modelName: string) => void;
  deleteModel: (modelFilename: string) => boolean;
  processOfflineInference: (prompt: string, modelFilename: string) => string;
  extractTextNatively: (localFileUri: string) => string;
}

declare global {
  interface Window {
    Android?: AndroidBridgeInterface;
    onModelDownloadProgress?: (filename: string, progress: number) => void;
    onStorageDirectorySelected?: (path: string) => void;
  }
}

export const getAndroidBridge = (): AndroidBridgeInterface | undefined => {
  if (typeof window !== 'undefined') {
    // Direct access
    const androidBridge = (window as any).Android;
    if (androidBridge) {
      return androidBridge;
    }

    // Check if we are inside an Android WebView
    const isAndroid = /android/i.test(navigator.userAgent);
    if (isAndroid) {
        // If we're on Android, we MUST NOT use the mock. Return a dummy that alerts so the user knows the bridge is broken.
        return {
           setStorageDirectory: () => alert("Native Bridge 'Android' not found! Please check your WebView addJavascriptInterface implementation and ensure Proguard/R8 is not stripping the interface."),
           getAvailableModels: () => { alert("Native Bridge missing: getAvailableModels"); return "[]"; },
           downloadModel: () => alert("Native Bridge missing: downloadModel"),
           deleteModel: () => { alert("Native Bridge missing: deleteModel"); return false; },
           processOfflineInference: () => "ERROR: Native Bridge 'Android' not found. Ensure MainActivity.java calls webView.addJavascriptInterface(offlineAIBridge, \"Android\") properly.",
           extractTextNatively: () => "ERROR: Native Bridge missing"
        };
    }
  }
  
  // Return a mock bridge for development/testing in the desktop browser
  if (typeof window !== 'undefined') {
    return {
      setStorageDirectory: async () => {
        if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
            try {
                const dirHandle = await (window as any).showDirectoryPicker();
                if (window.onStorageDirectorySelected) {
                    window.onStorageDirectorySelected(dirHandle.name);
                }
            } catch (e) {
                console.log("Directory selection cancelled", e);
            }
        } else {
            alert("Storage directory selection is only available in the native Android app or browsers that support the File System Access API (like Chrome Desktop).");
        }
      },
      getAvailableModels: () => {
        const mockModels = localStorage.getItem('mock_local_models');
        if (mockModels) return mockModels;
        
        // Return some dummy downloaded models so the UI can be tested
        return JSON.stringify([
          { name: "mock-downloaded-model.gguf", path: "/mock/path/model.gguf", sizeBytes: 2500000000 }
        ]);
      },
      downloadModel: (customUrl: string, modelName: string) => {
        console.log(`Mock downloading ${modelName} from ${customUrl}`);
        let progress = 0;
        const interval = setInterval(() => {
          progress += 10;
          if (window.onModelDownloadProgress) {
            window.onModelDownloadProgress(modelName, progress);
          }
          if (progress >= 100) {
            clearInterval(interval);
            // Save to mock storage so it shows up as downloaded
            const existingRaw = localStorage.getItem('mock_local_models') || '[]';
            const existing = JSON.parse(existingRaw);
            if (!existing.find((m: any) => m.name === modelName)) {
                existing.push({ name: modelName, path: "/mock/" + modelName, sizeBytes: 4000000000 });
                localStorage.setItem('mock_local_models', JSON.stringify(existing));
            }
          }
        }, 500);
      },
      deleteModel: (modelName: string) => {
        const existingRaw = localStorage.getItem('mock_local_models') || '[]';
        const existing = JSON.parse(existingRaw);
        const filtered = existing.filter((m: any) => m.name !== modelName);
        localStorage.setItem('mock_local_models', JSON.stringify(filtered));
        return true;
      },
      processOfflineInference: (prompt: string, modelFilename: string) => {
        return `[Browser Preview] I received your prompt: "${prompt}".\n\nNote: You are currently running the web version (dist). The real .gguf files cannot be executed directly by a web browser due to security sandbox limits. To use real native offline AI, you must build the provided 'android' folder using Android Studio into an APK.`;
      },
      extractTextNatively: (localFileUri: string) => {
        return "Mock extracted text from PDF/Image.";
      }
    };
  }

  return undefined;
};

export const isAndroidNative = (): boolean => {
  return typeof window !== 'undefined' && !!window.Android;
};

export const getLocalModels = (): AndroidModel[] => {
  const bridge = getAndroidBridge();
  if (!bridge) return [];
  try {
    const json = bridge.getAvailableModels();
    return JSON.parse(json);
  } catch (e) {
    console.error("Failed to parse local models from Android bridge", e);
    return [];
  }
};
