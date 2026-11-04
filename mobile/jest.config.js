module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Giới hạn số tiến trình chạy song song: mặc định (số nhân CPU − 1) làm ts-jest tràn bộ nhớ trên máy dev
  maxWorkers: 2,
  testMatch: ['**/__tests__/**/*.spec.ts', '**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '\\.(wav|mp3|m4a|aac|png|jpg|jpeg|gif|webp)$': '<rootDir>/src/test/fileMock.js',
  },
};

