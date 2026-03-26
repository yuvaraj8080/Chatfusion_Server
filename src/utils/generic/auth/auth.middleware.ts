import { NextFunction, Request, Response } from "express";
import { sign, verify } from "jsonwebtoken";

export const createAccessToken = (userId: any, type: string): string => {
  let token = sign({ userId, type }, process.env.ACCESS_TOKEN_SECRET as any, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN as any,
  });
  return token;
};

export const createAccessTokenForUser = (userId: any): string => {
  let token = sign({ userId }, process.env.ACCESS_TOKEN_SECRET as any, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN as any,
  });
  return token;
};

export const verifyAccessToken = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  try {
    // Extract token from various sources
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Verify the token
    const decoded = verify(token, process.env.ACCESS_TOKEN_SECRET as any);

    // Add decoded token payload to the request object
    (req as any).user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};
