// models/ にある GGUF とライセンス文を、iOS アプリ本体（バンドル）に同梱する config plugin。
// llama.rn からは initLlama({ model: 'llm.gguf', is_model_asset: true }) で読み込める。
// Metro のアセットにすると EAS Update で毎回 1GB 近く配信されてしまうため、ネイティブ側に置く。
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withXcodeProject, IOSConfig } = require('expo/config-plugins');

const FILES = ['llm.gguf', 'embed.gguf', 'LICENSE-LFM.txt'];

function withBundledModels(config) {
  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectName = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
      const dest = path.join(cfg.modRequest.platformProjectRoot, projectName);
      for (const file of FILES) {
        const src = path.join(cfg.modRequest.projectRoot, 'models', file);
        if (!fs.existsSync(src)) {
          throw new Error(`[with-bundled-models] ${src} がありません。scripts/download-models.sh を実行してください。`);
        }
        fs.copyFileSync(src, path.join(dest, file));
      }
      return cfg;
    },
  ]);

  config = withXcodeProject(config, (cfg) => {
    const projectName = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
    for (const file of FILES) {
      const filepath = `${projectName}/${file}`;
      if (!cfg.modResults.hasFile(filepath)) {
        IOSConfig.XcodeUtils.addResourceFileToGroup({
          filepath,
          groupName: projectName,
          isBuildFile: true,
          project: cfg.modResults,
        });
      }
    }
    return cfg;
  });

  return config;
}

module.exports = withBundledModels;
