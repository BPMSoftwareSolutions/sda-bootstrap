export function createUiCollectionProjector(interaction, state) {
  return Object.freeze({
    definitions: interaction.collections,
    stateBindings: interaction.stateBindings,
    collections: new Map(),
    project(definition) {
      const binding = interaction.stateBindingIndex.get(definition.stateId);
      const rows = state.resolve(binding);
      const projected = Array.isArray(rows) ? rows : [];
      this.collections.set(definition.collectionId, projected);
      return projected;
    }
  });
}


