module.exports = function (api) {
  const testing = api.env('test');
  return {
    presets: ['babel-preset-expo'],
    // Jest runs CommonJS; transform lazy imports so module-boundary mocks apply.
    plugins: testing ? ['@babel/plugin-transform-dynamic-import'] : [],
  };
};
