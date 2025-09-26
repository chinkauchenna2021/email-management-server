import { Request, Response, NextFunction } from 'express';
// import { createClient } from 'redis';
import { logger } from '../utils/logger';
import  rateLimit from "express-rate-limit";



export const rateLimiter = (windowTime:number, numberOfTrials:number) =>  rateLimit({
  windowMs: windowTime * 60 * 1000, // Convert minutes to milliseconds
  max: numberOfTrials, // start blocking after specified number of requests
  message:
    "Too many requests from this IP, please try again later",
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});