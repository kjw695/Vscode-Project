import React from 'react';

// 💡 달성률에 따라 색상을 계산하는 함수
const getProgressColor = (progress) => {
  const hue = progress * 1.2; // 0%(빨강)에서 100%(초록)으로
  return `hsl(${hue}, 90%, 55%)`;
};

// 💡 배경색의 밝기를 계산하여 대비되는 글자색(검정/흰색)을 반환하는 함수
const getContrastColor = (rgbColor) => {
    const rgb = rgbColor?.match(/\d+/g);
    if (!rgb) return 'white';
    const [r, g, b] = rgb.map(Number);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? 'black' : 'white';
};

// 🚀 이모지와 똑같은 모양의 새로운 로켓 아이콘 컴포넌트
const RocketIcon = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g transform="rotate(-45 12 12)">
            {/* 로켓 몸체 (흰색/연회색) */}
            <path d="M9.522 2.623c.39-.695 1.34-.852 2.115-.373l.084.056 3.63 2.904.37.296a1.14 1.14 0 0 1 .53 1.168l-.03.11-1.523 5.568c0 .28.08.558.23.79l.013.024 4.54 6.355a.869.869 0 0 1-.05 1.21l-.085.068a.867.867 0 0 1-1.124-.049l-4.54-6.355a1.86 1.86 0 0 1-.371-.814l1.523-5.568-3.5-2.8z" fill="#EAEAEA" stroke="#555" strokeWidth="0.5"/>
            {/* 로켓 날개 (빨간색) */}
            <path d="M15.22 17.556c.234.33.16.78-.17 1.013l-.085.06-2.14 1.528a.571.571 0 0 1-.74-.033l-.05-.05-4.286-4.286a.571.571 0 0 1-.034-.74l.05-.05 1.528-2.14a.571.571 0 0 1 .824-.136l.086.06L15.22 17.556z" fill="#D92E2E" stroke="#2c2c2c" strokeWidth="0.5"/>
            <path d="M7.78 11.556c.234.33.16.78-.17 1.013l-.085.06-2.14 1.528a.571.571 0 0 1-.74-.033l-.05-.05-1.286-1.286a.571.571 0 0 1-.034-.74l.05-.05 1.528-2.14a.571.571 0 0 1 .824-.136l.086.06L7.78 11.556z" fill="#D92E2E" stroke="#2c2c2c" strokeWidth="0.5"/>
        </g>
    </svg>
);


const GoalProgressBar = ({ current, goal, isDarkMode }) => {
  const progress = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  const progressColor = getProgressColor(progress);

  const barRef = React.useRef(null);
  const [textColor, setTextColor] = React.useState('white');

  React.useEffect(() => {
    if (barRef.current) {
        const bgColor = window.getComputedStyle(barRef.current).backgroundColor;
        setTextColor(getContrastColor(bgColor));
    }
  }, [progress, isDarkMode]);

  return (
    <div className="w-full mt-2">
      <div className="relative pt-4 pb-2">
        {/* 진행률 바 컨테이너 */}
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          {/* 채워지는 바 */}
          <div
            ref={barRef}
            className="h-5 rounded-full transition-all duration-500 ease-out flex items-center justify-end"
            style={{ width: `${progress}%`, backgroundColor: progressColor }}
          >
            <span className={`text-xs font-bold px-2`} style={{ color: textColor }}>
                {`${Math.floor(progress)}%`}
            </span>
          </div>
        </div>

        {/* 로켓 아이콘 */}
        <div
          className="absolute top-0"
          style={{ 
            left: `calc(${progress}% - 14px)`,
            transition: 'left 0.5s ease-out' 
          }}
        >
          {/* 직접 만든 로켓 아이콘 컴포넌트를 사용합니다. */}
          <RocketIcon className="w-7 h-7" />
        </div>
      </div>
    </div>
  );
};

export default GoalProgressBar;