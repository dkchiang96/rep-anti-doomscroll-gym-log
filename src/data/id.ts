// uuid relies on crypto.getRandomValues(), which Hermes doesn't provide
// natively (Node does, which is why this isn't needed under Jest).
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export function newId(): string {
  return uuidv4();
}
