import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import NoteRunner from "@/pages/NoteRunner";
import ChordPuzzle from "@/pages/ChordPuzzle";
import ModeComposer from "@/pages/ModeComposer";
import EarTraining from "@/pages/EarTraining";
import Encyclopedia from "@/pages/Encyclopedia";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/note-runner" element={<NoteRunner />} />
        <Route path="/chord-puzzle" element={<ChordPuzzle />} />
        <Route path="/mode-composer" element={<ModeComposer />} />
        <Route path="/ear-training" element={<EarTraining />} />
        <Route path="/encyclopedia" element={<Encyclopedia />} />
      </Routes>
    </Router>
  );
}
