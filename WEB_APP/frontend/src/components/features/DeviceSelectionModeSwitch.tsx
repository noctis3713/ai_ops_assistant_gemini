/**
 * 設備選擇模式切換器
 * 允許用戶在單一設備、多設備和群組模式之間切換
 */
import { type DeviceSelectionModeSwitchProps } from '@/types';

const DeviceSelectionModeSwitch = ({ 
  mode, 
  onModeChange 
}: DeviceSelectionModeSwitchProps) => {
  const modes = [
    { value: 'multiple', label: '設備選擇', icon: '🔧' },
  ] as const;

  return (
    <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
      {modes.map(({ value, label, icon }) => (
        <button
          key={value}
          onClick={() => onModeChange(value)}
          className={`
            flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200
            ${mode === value
              ? 'bg-terminal-bg-card text-blue-600 shadow-sm ring-1 ring-blue-200'
              : 'text-terminal-text-secondary hover:text-terminal-text-primary hover:bg-gray-50'
            }
          `}
        >
          <span className="text-base">{icon}</span>
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
};

export default DeviceSelectionModeSwitch;