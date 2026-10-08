/** Keep unattended runtime updates on the reviewed major version. */
export function assertRuntimeUpgrade(component, current, next, { allowMajor = false } = {}) {
  const parse = (version) => {
    if (!/^\d+\.\d+\.\d+$/u.test(version)) throw new Error(`Unsupported stable version: ${version}`);
    return version.split(".").map(Number);
  };
  const before = parse(current);
  const after = parse(next);
  const difference = after.map((value, index) => value - before[index]).find((value) => value !== 0) ?? 0;
  if (difference < 0) throw new Error(`${component} downgrade refused: ${current} -> ${next}`);
  if (before[0] !== after[0] && !allowMajor) {
    throw new Error(`${component} major upgrade requires compatibility review: ${current} -> ${next}. Use --allow-major after reviewing the target release.`);
  }
}

/** A changed component must not silently replace an unchanged component's assets. */
export function assertUnchangedRuntimeAssets(current, next) {
  for (const [platform, artifacts] of Object.entries(current)) {
    for (const artifact of artifacts) {
      const candidate = next[platform]?.find((item) => item.destination === artifact.destination);
      if (candidate?.url === artifact.url && (candidate.sha256 !== artifact.sha256 || candidate.archive !== artifact.archive)) {
        throw new Error(`Release asset changed without a URL change: ${platform}/${artifact.destination}`);
      }
    }
  }
}
