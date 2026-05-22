import jwt, { SignOptions } from 'jsonwebtoken';

interface TokenPayload {
  userId: number;
  email: string;
  tipoUsuario: string;
}

// Funciones getter que leen el valor CADA VEZ que se usan
const getJWTSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('❌ CRÍTICO: JWT_SECRET no está definido');
    throw new Error('JWT_SECRET no está configurado en las variables de entorno');
  }
  return secret;
};

const getJWTRefreshSecret = (): string => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    console.error('❌ CRÍTICO: JWT_REFRESH_SECRET no está definido');
    throw new Error('JWT_REFRESH_SECRET no está configurado en las variables de entorno');
  }
  return secret;
};

export const generateAccessToken = (payload: TokenPayload): string => {
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(payload, getJWTSecret(), { expiresIn } as SignOptions);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
  return jwt.sign(payload, getJWTRefreshSecret(), { expiresIn } as SignOptions);
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, getJWTSecret()) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, getJWTRefreshSecret()) as TokenPayload;
};

export const generateTokens = (payload: TokenPayload) => {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload)
  };
};