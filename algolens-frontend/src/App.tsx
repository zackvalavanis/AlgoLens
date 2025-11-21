import './App.css'
import { RouterProvider, Outlet, createBrowserRouter } from 'react-router-dom'
import { Header } from './screens/Header'
import { Footer } from './screens/Footer'
import { Main } from './screens/Main'

function App() {

  const router = createBrowserRouter([
    {
      element: (
        <div>
          <Header />
          <Outlet />
          <Footer />
        </div>
      ),
      children: [
        { path: '/', element: <Main /> }
      ]
    },
  ])

  return (
    <>
      <RouterProvider router={router} />
    </>
  )
}
export default App
