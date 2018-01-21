import './globals'
import { open as openMain } from './pages/config'

if (typeof nw !== 'undefined') {
  openMain()
  // IPC.start({})
}
