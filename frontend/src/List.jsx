
function List(){
    
    const options = ["option1", "op2", "op3", "op4"];

    const listItems = options.map(option => <li> {option}</li>);

    return (<ul className="items">{listItems}</ul>);
}
export default List