import { useRef } from 'react';

interface CodeInputProps {
  value: string[];
  onChange: (digits: string[]) => void;
  invalid: boolean;
}

export default function CodeInput({ value, onChange, invalid }: CodeInputProps) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  function insert(index: number, text: string) {
    const digits = text.replace(/\D/g, '').slice(0, 6);
    if (!digits) return;
    const start = digits.length === 6 ? 0 : index;
    const next = [...value];
    for (let offset = 0; offset < digits.length && start + offset < 6; offset++) {
      next[start + offset] = digits[offset];
    }
    onChange(next);
    inputs.current[Math.min(start + digits.length, 5)]?.focus();
  }

  return (
    <fieldset className="code-fields">
      <legend className="visually-hidden">6-digit verification code</legend>
      <div className="code-inputs">
        {value.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              inputs.current[index] = element;
            }}
            aria-label={`Digit ${index + 1} of 6`}
            aria-invalid={invalid}
            aria-describedby={invalid ? 'code-error' : undefined}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            autoFocus={index === 0}
            pattern="[0-9]"
            required
            value={digit}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => {
              if (!event.target.value) {
                const next = [...value];
                next[index] = '';
                onChange(next);
              } else insert(index, event.target.value);
            }}
            onPaste={(event) => {
              event.preventDefault();
              insert(index, event.clipboardData.getData('text'));
            }}
            onKeyDown={(event) => {
              if (event.key === 'Backspace') {
                event.preventDefault();
                const target = digit ? index : Math.max(0, index - 1);
                const next = [...value];
                next[target] = '';
                onChange(next);
                inputs.current[target]?.focus();
              } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                inputs.current[
                  Math.max(0, Math.min(5, index + (event.key === 'ArrowLeft' ? -1 : 1)))
                ]?.focus();
              }
            }}
          />
        ))}
      </div>
    </fieldset>
  );
}
