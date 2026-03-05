'use client';

export function Loader({ className = '' }: { className?: string }) {
  const text = 'ЗАГРУЗКА';
  
  return (
    <div className={`loader-container ${className}`}>
      <div className="loader-wrapper">
        <div className="loader-text">
          {/* 9 layers with different clip-paths for the animation effect */}
          <span className="loader-text-layer" style={{ clipPath: 'polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)' }}>{text}</span>
          <span className="loader-text-layer" style={{ clipPath: 'polygon(0% 90%,  100% 90%,  100% 100%, 0% 100%)' }}>{text}</span>
          <span className="loader-text-layer" style={{ clipPath: 'polygon(0% 80%,  100% 80%,  100% 90%,  0% 90%)' }}>{text}</span>
          <span className="loader-text-layer" style={{ clipPath: 'polygon(0% 70%,  100% 70%,  100% 80%,  0% 80%)' }}>{text}</span>
          <span className="loader-text-layer" style={{ clipPath: 'polygon(0% 60%,  100% 60%,  100% 70%,  0% 70%)' }}>{text}</span>
          <span className="loader-text-layer" style={{ clipPath: 'polygon(0% 50%,  100% 50%,  100% 60%,  0% 60%)' }}>{text}</span>
          <span className="loader-text-layer" style={{ clipPath: 'polygon(0% 40%,  100% 40%,  100% 50%,  0% 50%)' }}>{text}</span>
          <span className="loader-text-layer" style={{ clipPath: 'polygon(0% 30%,  100% 30%,  100% 40%,  0% 40%)' }}>{text}</span>
          <span className="loader-text-layer" style={{ clipPath: 'polygon(0% 20%,  100% 20%,  100% 30%,  0% 30%)' }}>{text}</span>
        </div>
        <div className="loader-line" />
      </div>
    </div>
  );
}

export default Loader;
