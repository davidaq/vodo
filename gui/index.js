import './globals'
import { open as openMain } from './pages/main'

if (typeof nw !== 'undefined') {
  openMain()
  // IPC.start({})
}
