import TextPage from "./Page/TextPage";
import "./App.css";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import Landing from "./Page/Landing";
import ContextProvider from "./Context/ContextProvider";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Landing />,
    errorElement: <h1>404 Not Found</h1>,
  },
  {
    path: "/text",
    element: <TextPage />,
  },
]);

function App() {
  return (
    <ContextProvider>
      <RouterProvider router={router} />
    </ContextProvider>
  );
}

export default App;
