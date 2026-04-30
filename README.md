## Local build
eas build --profile development --platform ios

npx expo start

## Testflight build

eas build --platform ios --profile production

eas submit --platform ios --profile production