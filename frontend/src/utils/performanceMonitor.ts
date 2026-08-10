// Performance monitoring for low-end devices
export interface PerformanceMetrics {
  fps: number;
  memoryUsage: number;
  isLowEnd: boolean;
  cpuCores: number;
}

class PerformanceMonitor {
  private frameCount = 0;
  private lastTime = performance.now();
  private fps = 60;
  private memoryCheckInterval = 5000;
  private lastMemoryCheck = 0;
  private memoryUsage = 0;
  private observers: ((metrics: PerformanceMetrics) => void)[] = [];

  constructor() {
    this.detectDeviceClass();
    this.startMonitoring();
  }

  private detectDeviceClass() {
    const cpus = navigator.hardwareConcurrency || 1;
    const isLowEnd = cpus <= 4;
    const memory = (navigator as any).deviceMemory || 4;
    return { isLowEnd, cpus, memory };
  }

  private startMonitoring() {
    setInterval(() => {
      if (performance.memory) {
        this.memoryUsage = performance.memory.usedJSHeapSize / 1048576; // MB

        if (this.memoryUsage > 300) {
          console.warn(`High memory usage: ${this.memoryUsage.toFixed(1)}MB`);
          this.triggerGC();
        }
      }
    }, this.memoryCheckInterval);
  }

  measureFrame() {
    this.frameCount++;
    const now = performance.now();
    const deltaTime = now - this.lastTime;

    if (deltaTime >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / deltaTime);
      this.frameCount = 0;
      this.lastTime = now;
      this.notifyObservers();
    }
  }

  private triggerGC() {
    if ((window as any).gc) {
      (window as any).gc();
    }
  }

  subscribe(callback: (metrics: PerformanceMetrics) => void) {
    this.observers.push(callback);
    return () => {
      this.observers = this.observers.filter((o) => o !== callback);
    };
  }

  private notifyObservers() {
    const { isLowEnd, cpus } = this.detectDeviceClass();
    const metrics: PerformanceMetrics = {
      fps: this.fps,
      memoryUsage: this.memoryUsage,
      isLowEnd,
      cpuCores: cpus,
    };
    this.observers.forEach((cb) => cb(metrics));
  }

  getMetrics(): PerformanceMetrics {
    const { isLowEnd, cpus } = this.detectDeviceClass();
    return {
      fps: this.fps,
      memoryUsage: this.memoryUsage,
      isLowEnd,
      cpuCores: cpus,
    };
  }
}

export const performanceMonitor = new PerformanceMonitor();
