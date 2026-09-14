import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './VerifyCodePage.css';
function VerifyCodePage() {
    const location = useLocation();
    const navigate = useNavigate();
    const email = location.state?.email || 'your@email.com';
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
    function handleChange(index: number, value: string) {
        const digit = value.replace(/\D/g, '');
        if (!digit) {
            const newCode = [...code];
            newCode[index] = '';
            setCode(newCode);
            return;
        }
        const newCode = [...code];
        newCode[index] = digit.slice(-1);
        setCode(newCode);
        if (index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    }
    function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
        if (event.key === 'Backspace' &&
            code[index] === '' &&
            index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    }
    function handleContinue() {
        const fullCode = code.join('');
        if (fullCode.length !== 6) {
            return;
        }
        // Temporary frontend-only test
        console.log('Code entered:', fullCode);
        navigate('/home');
    }
    const isComplete = code.every((digit) => digit !== '');
    return (<div className="verify-page">
      <div className="verify-container">

        <div className="logo">
          Put<span>MeOn</span>
        </div>

        <p className="tagline">
          Find work. Find subbies.
        </p>

        <div className="verify-card">

          <h2>Check your email</h2>

          <p className="verify-message">
            We've sent a 6-digit code to
          </p>

          <p className="verify-email">
            {email}
          </p>

          <div className="code-inputs">
            {code.map((digit, index) => (<input key={index} ref={(element) => {
                inputRefs.current[index] = element;
            }} type="text" inputMode="numeric" maxLength={1} value={digit} onChange={(event) => handleChange(index, event.target.value)} onKeyDown={(event) => handleKeyDown(index, event)}/>))}
          </div>

          <button type="button" className="continue-button" disabled={!isComplete} onClick={handleContinue}>
            Continue
          </button>

          <p className="resend-text">
            Didn't receive a code?{' '}
            <button type="button" className="resend-button">
              Resend
            </button>
          </p>

        </div>
      </div>
    </div>);
}
export default VerifyCodePage;
