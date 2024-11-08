import React, { useState } from 'react';
// import {  } from '../../api/auth';
import { registerUser, resendVerificationEmail, verificationStatus } from '../../api/user';

interface SignupFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const Signup: React.FC = () => {
  const [formData, setFormData] = useState<SignupFormData>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(false);
  const [isRegistered, setIsRegistered] = useState<boolean>(false);

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
      const user = await registerUser({
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });
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
      const response = await resendVerificationEmail(formData.email);
      setMessage(response || "Verification email resent! Please check your inbox.");
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || "Failed to resend verification email.";
      setError(errorMessage);
    }
  };

  const handleEmailVerification = async () => {
    try {
      const status = await verificationStatus(formData.email);
      console.log(status);
      if (!status) {
        setError("Email is not verified yet.");
        return;
      }
      setError(null);
      setIsEmailVerified(true);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || "Failed to verify email.";
      setError(errorMessage);
    }
  };

  return (
    <div>
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
        
        {isRegistered ? 
          <button onClick={handleEmailVerification}>Verify Email</button> 
          : 
          <button type='submit' onClick={handleSubmit}>register</button> 
        }
        
      </form>

      {message && <p style={{ color: 'green' }}>{message}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Show this option only if registered but not verified */}
      {isRegistered && !isEmailVerified && (
        <div>
          <p>Didn’t receive the verification email?</p>
          <button onClick={handleResendEmail}>Resend Verification Email</button>
        </div>
      )}
    </div>
  );
};

export default Signup;
