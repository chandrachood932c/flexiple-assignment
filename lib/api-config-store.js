const configs = new Map();

export function setApiConfig(sessionId, config) {
  configs.set(sessionId, config);
}

export function getApiConfig(sessionId) {
  return configs.get(sessionId);
}

export function deleteApiConfig(sessionId) {
  configs.delete(sessionId);
}