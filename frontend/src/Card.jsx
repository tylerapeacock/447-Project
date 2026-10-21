import OrderedList from "./OrderedList.jsx";
const steps = [
  { id: 1, label: "Install Node" },
  { id: 2, label: "Create the project" },
  { id: 3, label: "Run npm install" },
];

function Card(props) {
  return (
    <div className="card">
      <h2 className="card-title">Sample header</h2>
      <OrderedList items={steps}></OrderedList>
      
    </div>
  );
}
export default Card;
