import serverless from "serverless-http";
import { app } from "../../server.ts";

console.log("Netlify Function: API handler initialized");

export const handler = serverless(app);
