import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from "firebase/firestore";
import { db } from "../config";

export const useCrud = () => {
    const addUser = async () => {
        const docRef = await addDoc(collection(db, "users"), {
            name: "Alice",
            age: 25,
            city: "Mumbai",
            languge:["English","Hindi"]
        });
        console.log("Document written with ID:", docRef.id);
    };
    const deleteUser = async (userId: any) => {
        await deleteDoc(doc(db, "users", userId));
    };
    const getUsers = async () => {
        const querySnapshot = await getDocs(collection(db, "users"));
        querySnapshot.forEach((doc) => {
            console.log(doc.id, "=>", doc.data());
        });
    };
    const updateUser = async (userId: any) => {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
            age: 26
        });
    };

    return {
        addUser,
        deleteUser,
        getUsers,
        updateUser
    }

}