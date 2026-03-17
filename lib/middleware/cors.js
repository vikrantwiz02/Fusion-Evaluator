import cors from 'cors';
import config from '../config.js';

const corsOptions = {
  origin: config.allowedOrigins.length > 0 ? config.allowedOrigins : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

export default cors(corsOptions);
