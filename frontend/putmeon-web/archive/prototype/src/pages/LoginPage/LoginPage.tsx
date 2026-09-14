import { useNavigate } from 'react-router-dom';
import './LoginPage.css';
import brisbaneImage from '../../assets/Peopleback.png';
function LoginPage() {
    const navigate = useNavigate();
    function handleSendCode() {
        navigate('/verify-code', {
            state: {
                email: 'your@email.com'
            }
        });
    }
    return (<div className="login-page">
      <div className="login-content">

        <div className="logo">
          Put<span>MeOn</span>
        </div>

        <p className="tagline">
          Find work. Find subbies.
        </p>

        <div className="login-card">
          <h2>Welcome</h2>

          <p className="subtitle">
            Enter your email to get a login code.
          </p>

          <label htmlFor="email">Email</label>

          <input id="email" type="email" placeholder="your@email.com"/>

          <button type="button" onClick={handleSendCode}>
            Send Code
          </button>
        </div>

        <div className="bottom-text">
          <strong>Built for Brisbane tradies.</strong>
          <p>Simple. Local. Real work.</p>
        </div>

      </div>

      <div className="city-image">
        <img src={brisbaneImage} alt="Construction workers"/>
      </div>
    </div>);
}
export default LoginPage;
