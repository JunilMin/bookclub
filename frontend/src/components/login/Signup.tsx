import React, { useState } from 'react';
import { verifyEmail } from '../../api/auth';
import { registerUser, resendVerificationEmail } from '../../api/user';

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
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
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
      // Send verification email
      const response = await resendVerificationEmail(formData.email);
      setMessage(response || "Verification email sent! Please check your inbox.");
      setError(null);
      setVerificationToken("dummy-token"); // Assuming a token is returned by the backend
      setIsRegistered(true); // Set isRegistered to true after registration
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || "Failed to send verification email.";
      setError(errorMessage);
    }
  };

  const handleEmailVerification = async () => {
    if (!verificationToken) return;

    try {
      // Verify the email
      const verificationMessage = await verifyEmail(verificationToken);
      setMessage(verificationMessage);
      setError(null);
      setIsEmailVerified(true);

      // Register the user after successful email verification
      await registerUser({
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });

      setMessage("Registration successful! You can now log in.");
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || "Failed to verify email.";
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
        <button type="submit">
          {isRegistered ? "Verify Email" : "Register"}
        </button>
      </form>

      {message && <p style={{ color: 'green' }}>{message}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {!isEmailVerified && verificationToken && (
        <div>
          <p>Haven't received the verification email?</p>
          <button onClick={handleEmailVerification}>Verify Email</button>
        </div>
      )}
    </div>
  );
};

export default Signup;
