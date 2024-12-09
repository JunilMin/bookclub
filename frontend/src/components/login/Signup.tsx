import React, { useState } from 'react';
import { useAuth } from '../../AuthContext/AuthContext';

interface SignupFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const Signup: React.FC = () => {
  const { handleRegister, resendVerificationEmail, verificationStatus} = useAuth();
  const [formData, setFormData] = useState<SignupFormData>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState<boolean>(false);

  const [token, setToken] = useState<string>('');
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(false);

  const handleTokenInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setToken(e.target.value);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      // Register the user
      await handleRegister(formData.email, formData.password, formData.username);
      setMessage("Registration successful! Please check your email to verify your account.");
      setError(null);
      setIsRegistered(true); // Mark as registered to control UI state
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || "Registration failed.";
      setError(errorMessage);
    }
  };

  const handleResendEmail = async () => {
    try {
      // Resend verification email if not received
      await resendVerificationEmail();
      setMessage("Verification email resent! Please check your inbox.");
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || "Failed to resend verification email.";
      setError(errorMessage);
    }
  };

  // const handleVerifyToken = async () => {
  //   try {
  //     await verifyRegisterToken(token, formData.email);
  //     setMessage("Email verified successfully!");
  //     setError(null);
  //     setIsEmailVerified(true);
  //   } catch (err: any) {
  //     const errorMessage = err?.response?.data?.message || "Failed to verify email.";
  //     setError(errorMessage);
  //   }
  // }
  // const handleCheckVerificationToken = async () => {
  //   try {
  //     const token = await getVerificationToken(formData.email);
  //     console.log(token);
  //   } catch (err: any) {
  //     const errorMessage = err?.response?.data?.message || "Failed to get verification token.";
  //     setError(errorMessage);
  //   }
  // }

  // const handleEmailVerification = async () => {
  //   try {
  //     const status = await verificationStatus(formData.email);
  //     console.log(status);
  //     if (!status) {
  //       setError("Email is not verified yet.");
  //       return;
  //     }
  //     setError(null);
  //     setIsEmailVerified(true);
  //   } catch (err: any) {
  //     const errorMessage = err?.response?.data?.message || "Failed to verify email.";
  //     setError(errorMessage);
  //   }
  // };

  return (
    
    <div>
      {!isRegistered ? (
  <>
    <h2>Sign Up</h2>
    <form onSubmit={handleSubmit}>
      <div>
        <label>Username:</label>
        <input
          type="text"
          name="username"
          value={formData.username}
          onChange={handleChange}
          required
        />
      </div>
      <div>
        <label>Email:</label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
        />
      </div>
      <div>
        <label>Password:</label>
        <input
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          required
        />
      </div>
      <div>
        <label>Confirm Password:</label>
        <input
          type="password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          required
        />
      </div>
      <button type="submit">Register</button>
    </form>
  </>
  ) : null}
      

      {message && <p style={{ color: 'green' }}>{message}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Show this option only if registered but not verified */}
      {isRegistered && (
        <div>
          <button onClick={handleResendEmail}>Resend Verification Email</button>
            <div>
            <p>Enter verification token:</p>
            <input
              type="text"
              value={token}
              onChange={handleTokenInput}
              placeholder="Verification Token"
              required
            />
            <button onClick={verificationStatus}>Verify Token</button>
          </div>
          {/* <button onClick={handleEmailVerification}>Verify Email</button>  */}
        </div>
      )}
    </div>
  );
};

export default Signup;
