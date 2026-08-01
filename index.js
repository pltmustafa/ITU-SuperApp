import { registerRootComponent } from 'expo';
import { LogBox } from 'react-native';

const ignoreWarns = [
  'The app is running using the Legacy Architecture',
  'expo-background-fetch: This library is deprecated',
  'This method is deprecated',
  'React Native Firebase namespaced API'
];

LogBox.ignoreLogs(ignoreWarns);

const originalWarn = console.warn;
console.warn = (...args) => {
  const argStr = args.join(' ');
  if (ignoreWarns.some(warn => argStr.includes(warn))) {
    return;
  }
  originalWarn(...args);
};

import App from './App';

registerRootComponent(App);
