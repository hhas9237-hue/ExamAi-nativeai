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
  if (typeof window !== 'undefined' && window.Android) {
    return window.Android;
  }
  
  // Return a mock bridge for development/testing in the browser
  if (typeof window !== 'undefined') {
    return {
      setStorageDirectory: () => {
        alert("Mock: Storage directory selection opened. (Android Native Only)");
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
        return "This is a mock offline response since you are running in a web browser without the native Android app.";
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
