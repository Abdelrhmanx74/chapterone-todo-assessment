const { withProjectBuildGradle } = require('@expo/config-plugins');

const withKotlinVersion = (config, version) => {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      // Force Kotlin version
      config.modResults.contents = config.modResults.contents.replace(
        /classpath\(['"]org\.jetbrains\.kotlin:kotlin-gradle-plugin['"]\)/,
        `classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:${version}")`
      );
      // Force AGP version (React Native 0.81 likes 8.11.0)
      config.modResults.contents = config.modResults.contents.replace(
        /classpath\(['"]com\.android\.tools\.build:gradle['"]\)/,
        `classpath("com.android.tools.build:gradle:8.11.0")`
      );
    }
    return config;
  });
};

module.exports = withKotlinVersion;
