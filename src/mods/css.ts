import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { log } from "../utils/logger";

export function loadCustomCss(appRoot: string) {
  const cssPath = path.join(appRoot, "resources", "custom.css");
  if (!existsSync(cssPath)) {
    return "";
  }

  try {
    return readFileSync(cssPath, "utf-8");
  } catch (error) {
    log.warn("[css] failed to read custom stylesheet", cssPath, error);
    return "";
  }
}
