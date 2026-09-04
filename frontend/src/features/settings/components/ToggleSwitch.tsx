import { cn } from '../../../lib/utils';

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export function ToggleSwitch({ checked, onChange, disabled = false, label }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      className={cn(
        'relative inline-flex w-11 h-6 shrink-0 items-center rounded-full border transition-colors duration-150 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5e7ce2]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0f12]',
        'active:scale-[0.98]',
        checked
          ? 'bg-[#5e7ce2] border-[#5e7ce2] shadow-[0_0_12px_rgba(94,124,226,0.45)]'
          : 'bg-[#2d2d34] border-[#3a3a45]',
        disabled && 'opacity-50 cursor-not-allowed active:scale-100'
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 ease-out',
          checked ? 'translate-x-[22px]' : 'translate-x-[3px]'
        )}
      />
    </button>
  );
}

export default ToggleSwitch;
