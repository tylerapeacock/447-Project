function List() {
  const options = [
    { id: 1, label: "option1" },
    { id: 2, label: "op2" },
    { id: 3, label: "op3" },
    { id: 4, label: "op4" },
  ];

  const listItems = options.map((option) => (
    <li key={option.id}>{option.label}</li>
  ));
  

  return <ul className="items">{listItems}</ul>;
  
}

export default List;