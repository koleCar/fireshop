import {Injectable} from '@angular/core';
import {AngularFireAuth} from '@angular/fire/auth';
import {AngularFirestore} from '@angular/fire/firestore';
import {User} from 'firebase/app';
import {BehaviorSubject, combineLatest, Observable, of} from 'rxjs';
import {distinctUntilChanged, map, switchMap} from 'rxjs/operators';
import {FirestoreCollections} from '@jf/enums/firestore-collections.enum';
import {Customer} from '../../interfaces/customer.interface';

@Injectable({
  providedIn: 'root'
})
export class StateService {
  constructor(private afAuth: AngularFireAuth, private afs: AngularFirestore) {
    this.user$ = combineLatest(this.afAuth.user, this.logInValid$).pipe(
      switchMap(([user, loginValid]) => {
        if (loginValid && user) {
          return this.afs
            .doc(`${FirestoreCollections.Customers}/${user.uid}`)
            .valueChanges()
            .pipe(
              map(doc => {
                return {authData: user, customerData: doc};
              })
            );
        } else {
          return of(null);
        }
      }),
      distinctUntilChanged()
    );
  }

  logInValid$ = new BehaviorSubject<boolean>(true);
  user$: Observable<{authData: User; customerData: Customer}>;

  currentRoute$ = new BehaviorSubject<{data: any; url: string}>({
    data: {},
    url: '/'
  });
}