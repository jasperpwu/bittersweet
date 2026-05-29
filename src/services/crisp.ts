import { configure, show } from 'crisp-sdk-react-native';

const CRISP_WEBSITE_ID = 'cd116fcd-5d88-476c-8051-06566eea723a';

export function configureCrisp() {
  configure(CRISP_WEBSITE_ID);
}

export function openChat() {
  show();
}
