interface ClockInstance {
  stop: () => void;
  destroy: () => void;
}

class OPaper {
  private timer: number | null = null;
  private container: HTMLElement | null = null;
  private clockContainer: HTMLElement | null = null;
  private timeElement: HTMLElement | null = null;
  private dateElement: HTMLElement | null = null;
  private dayElement: HTMLElement | null = null;

  start(root: HTMLElement): ClockInstance {
    this.container = root;
    this.init();
    this.update();
    this.timer = window.setInterval(this.update, 1000);

    return {
      stop: () => this.stop(),
      destroy: () => this.destroy()
    };
  }

  private init(): void {
    if (!this.container) return;

    this.container.innerHTML = '';
    this.applyContainerStyles();
    this.clockContainer = this.createClockContainer();
    const clockFace = this.createClockFace();
    this.clockContainer.appendChild(clockFace);
    const timeDisplay = this.createTimeDisplay();
    clockFace.appendChild(timeDisplay);
    this.createDecorations(clockFace);
    this.container.appendChild(this.clockContainer);
    this.createBackgroundDecorations();
  }

  private applyContainerStyles(): void {
    if (!this.container) return;

    Object.assign(this.container.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      margin: '0',
      padding: '0',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #667eea 100%)',
      backgroundSize: '400% 400%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      zIndex: '-1',
      pointerEvents: 'none'
    });

    this.addAnimation('gradientFlow', `
      @keyframes gradientFlow {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
    `);
    this.container.style.animation = 'gradientFlow 15s ease infinite';
  }

  private createClockContainer(): HTMLElement {
    const container = document.createElement('div');
    Object.assign(container.style, {
      position: 'relative',
      pointerEvents: 'auto',
      zIndex: '1'
    });

    this.addAnimation('float', `
      @keyframes float {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-20px); }
      }
    `);
    container.style.animation = 'float 3s ease-in-out infinite';

    return container;
  }

  private createClockFace(): HTMLElement {
    const face = document.createElement('div');
    Object.assign(face.style, {
      position: 'relative',
      background: 'white',
      borderRadius: '40px',
      padding: '60px 80px',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 10px rgba(255, 255, 255, 0.1), 0 0 0 20px rgba(255, 255, 255, 0.05)',
      transformStyle: 'preserve-3d',
      zIndex: '2'
    });
    return face;
  }

  private createTimeDisplay(): HTMLElement {
    const display = document.createElement('div');
    Object.assign(display.style, {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '20px',
      position: 'relative',
      zIndex: '10'
    });

    this.timeElement = document.createElement('span');
    Object.assign(this.timeElement.style, {
      fontSize: '96px',
      fontWeight: '900',
      color: '#667eea',
      letterSpacing: '8px',
      fontFamily: "'Arial Rounded MT Bold', 'Helvetica Rounded', Arial, sans-serif",
      position: 'relative',
      zIndex: '11',
      filter: 'drop-shadow(0 4px 20px rgba(102, 126, 234, 0.3))',
      lineHeight: '1',
      margin: '0',
      padding: '0'
    });

    this.addAnimation('pulse', `
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.02); }
      }
    `);
    this.timeElement.style.animation = 'pulse 2s ease-in-out infinite';

    this.dateElement = document.createElement('span');
    Object.assign(this.dateElement.style, {
      fontSize: '28px',
      fontWeight: '700',
      color: '#667eea',
      fontFamily: "'Arial Rounded MT Bold', 'Helvetica Rounded', Arial, sans-serif",
      position: 'relative',
      zIndex: '11',
      lineHeight: '1',
      margin: '0',
      padding: '0'
    });

    this.dayElement = document.createElement('span');
    Object.assign(this.dayElement.style, {
      fontSize: '24px',
      fontWeight: '600',
      color: '#764ba2',
      padding: '8px 24px',
      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
      borderRadius: '20px',
      fontFamily: "'Arial Rounded MT Bold', 'Helvetica Rounded', Arial, sans-serif",
      position: 'relative',
      zIndex: '11',
      lineHeight: '1',
      margin: '0'
    });

    display.appendChild(this.timeElement);
    display.appendChild(this.dateElement);
    display.appendChild(this.dayElement);

    return display;
  }

  private createDecorations(parent: HTMLElement): void {
    const decorations = [
      { size: 60, gradient: 'linear-gradient(135deg, #ffd89b 0%, #19547b 100%)', top: '-30px', left: '-30px', delay: '0s' },
      { size: 80, gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', bottom: '-40px', right: '-40px', delay: '-5s' },
      { size: 50, gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)', top: '50%', right: '-25px', delay: '-10s' },
      { size: 70, gradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', bottom: '50%', left: '-35px', delay: '-15s' }
    ];

    this.addAnimation('rotate', `
      @keyframes rotate {
        0% { transform: rotate(0deg) scale(1); }
        50% { transform: rotate(180deg) scale(1.1); }
        100% { transform: rotate(360deg) scale(1); }
      }
    `);

    decorations.forEach((config) => {
      const decoration = document.createElement('div');
      Object.assign(decoration.style, {
        position: 'absolute',
        width: `${config.size}px`,
        height: `${config.size}px`,
        borderRadius: '50%',
        background: config.gradient,
        boxShadow: `0 10px 30px ${config.gradient.match(/#[a-f0-9]{6}/i)?.[0] || 'rgba(0,0,0,0.4)'}40`,
        zIndex: '1',
        animation: `rotate 20s linear infinite`,
        animationDelay: config.delay
      });

      if (config.top) decoration.style.top = config.top;
      if (config.bottom) decoration.style.bottom = config.bottom;
      if (config.left) decoration.style.left = config.left;
      if (config.right) decoration.style.right = config.right;

      parent.appendChild(decoration);
    });
  }

  private createBackgroundDecorations(): void {
    if (!this.container) return;

    const decorations = [
      { size: 500, top: '-100px', left: '-100px', duration: '6s', reverse: false },
      { size: 400, bottom: '-100px', right: '-100px', duration: '8s', reverse: true }
    ];

    decorations.forEach((config) => {
      const decoration = document.createElement('div');
      Object.assign(decoration.style, {
        content: '""',
        position: 'absolute',
        width: `${config.size}px`,
        height: `${config.size}px`,
        borderRadius: '50%',
        background: 'white',
        opacity: '0.1',
        zIndex: '0',
        animation: `float ${config.duration} ease-in-out infinite ${config.reverse ? 'reverse' : ''}`
      });

      if (config.top) decoration.style.top = config.top;
      if (config.bottom) decoration.style.bottom = config.bottom;
      if (config.left) decoration.style.left = config.left;
      if (config.right) decoration.style.right = config.right;

      this.container!.appendChild(decoration);
    });
  }

  private addAnimation(name: string, keyframes: string): void {
    const styleId = `opaper-animation-${name}`;
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = keyframes;
      document.head.appendChild(style);
    }
  }

  private formatTime(): { time: string; date: string; day: string } {
    const now = new Date();

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const time = `${hours}:${minutes}:${seconds}`;

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}年${month}月${date}日`;

    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const day = days[now.getDay()];

    return { time, date: dateStr, day };
  }

  private update = (): void => {
    const timeData = this.formatTime();
    if (this.timeElement) this.timeElement.textContent = timeData.time;
    if (this.dateElement) this.dateElement.textContent = timeData.date;
    if (this.dayElement) this.dayElement.textContent = timeData.day;
  };

  private stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private destroy(): void {
    this.stop();
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// 导出单例实例
export const oPaper = new OPaper();
