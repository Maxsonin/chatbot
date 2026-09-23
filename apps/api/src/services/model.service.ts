import { models, type Model, type ModelId } from '../config/models.js';

export function getModels() {
  return models;
}

export function findModelById(modelId: ModelId): Model | undefined {
  return models.find((model) => model.id === modelId);
}
