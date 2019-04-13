import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  ViewChild
} from '@angular/core';
import {AngularFireAuth} from '@angular/fire/auth';
import {
  AngularFirestore,
  AngularFirestoreDocument
} from '@angular/fire/firestore';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {MatDialogRef, MatSnackBar} from '@angular/material';
import {RxDestroy} from '@jaspero/ng-helpers';
import {auth, firestore} from 'firebase';
import {filter, switchMap, take, takeUntil} from 'rxjs/operators';
import {FirestoreCollections} from '@jf/enums/firestore-collections.enum';
import {RepeatPasswordValidator} from '../../helpers/compare-passwords';
import {Customer} from '../../interfaces/customer.interface';
import {StateService} from '../../services/state/state.service';

enum View {
  LogIn,
  SignUp,
  Reset
}

@Component({
  selector: 'jfs-login-signup-dialog',
  templateUrl: './login-signup-dialog.component.html',
  styleUrls: ['./login-signup-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginSignupDialogComponent extends RxDestroy implements OnInit {
  constructor(
    public afAuth: AngularFireAuth,
    public snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<LoginSignupDialogComponent>,
    private afs: AngularFirestore,
    private fb: FormBuilder,
    private state: StateService
  ) {
    super();
  }

  @ViewChild('password') passwordField: ElementRef;

  logInForm: FormGroup;
  resetPasswordControl: FormControl;
  signUpForm: FormGroup;
  view = View;
  currentView: View = View.LogIn;

  validation = {
    [View.LogIn]: (
      docRef: AngularFirestoreDocument<Customer>,
      doc: firestore.DocumentSnapshot
    ) => {
      if (doc.exists) {
        this.state.logInValid$.next(true);
        this.dialogRef.close();
      } else {
        this.afAuth.auth.signOut();
        this.snackBar.open(
          'You do not have an account.Please sign up first!',
          'Dismiss',
          {
            duration: 2500
          }
        );
        this.connectListener();
      }
    },
    [View.SignUp]: (
      docRef: AngularFirestoreDocument<Customer>,
      doc: firestore.DocumentSnapshot
    ) => {
      this.state.logInValid$.next(true);

      if (doc.exists) {
        this.snackBar.open('Logged in with existing account', 'Dismiss', {
          duration: 2500
        });
      } else {
        docRef
          .set({
            createdOn: Date.now()
          })
          .then()
          .catch();
      }

      this.dialogRef.close();
    }
  };

  ngOnInit() {
    /**
     * If a user opens this dialog we
     * know he isn't logged in
     */
    this.state.logInValid$.next(false);

    this.buildForms();
    this.connectListener();
  }

  logInWithGoogle() {
    this.afAuth.auth.signInWithPopup(new auth.GoogleAuthProvider());
  }

  // Todo: login is not working now because Facebook does not allow to use localhost's domain and must connect with Jaspero's facebook
  logInWithFacebook() {
    this.afAuth.auth.signInWithPopup(new auth.FacebookAuthProvider());
  }

  // Todo: must connect Firestore with Twitter
  logInWithTwitter() {
    this.afAuth.auth.signInWithPopup(new auth.TwitterAuthProvider());
  }

  signUpWithEmail() {
    const data = this.signUpForm.getRawValue();

    this.afAuth.auth
      .createUserWithEmailAndPassword(data.email, data.pg.password)
      .then(() =>
        this.afAuth.auth.signInWithEmailAndPassword(
          data.email,
          data.pg.password
        )
      )
      .then(() => {
        this.dialogRef.close();
        this.snackBar.open('Your account has been created.', 'Dismiss', {
          duration: 2500
        });
      })
      .catch(res => {
        if (res.code === 'auth/invalid-email') {
          this.snackBar.open('Your email is invalid', 'Dismiss', {
            duration: 2000
          });
        } else {
          this.snackBar.open(
            'This email address is already in use',
            'Dismiss',
            {
              duration: 2000
            }
          );
        }
      });
  }

  loginWithEmail() {
    const dataLogin = this.logInForm.getRawValue();

    this.afAuth.auth
      .signInWithEmailAndPassword(dataLogin.email, dataLogin.password)
      .then(() => {
        this.dialogRef.close();
      })
      .catch(() => {
        this.snackBar.open(
          'The email and password you entered did not match our records. Please double-check and try again.',
          'Dismiss',
          {
            duration: 2500
          }
        );
        this.logInForm.get('password').reset();
        this.passwordField.nativeElement.focus();
      });
  }

  resetPassword() {
    this.afAuth.auth
      .sendPasswordResetEmail(this.resetPasswordControl.value)
      .then(() => {
        this.dialogRef.close();
        this.snackBar.open('Reset password email has been sent.', 'Dismiss', {
          duration: 2500
        });
      })
      .catch(() => {
        this.snackBar.open(
          'There is something wrong please try again.',
          'Dismiss',
          {
            duration: 2500
          }
        );
      });
  }

  toggleState(newView: View) {
    this.currentView = newView;
  }

  private buildForms() {
    this.logInForm = this.fb.group({
      email: ['', Validators.required],
      password: ['', Validators.required]
    });

    this.signUpForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      pg: this.fb.group(
        {
          password: ['', [Validators.required, Validators.minLength(6)]],
          repeatPassword: ['', [Validators.required, Validators.minLength(6)]]
        },
        {validator: RepeatPasswordValidator('Passwords not matching')}
      )
    });

    this.resetPasswordControl = this.fb.control('', [
      Validators.required,
      Validators.email
    ]);
  }

  private connectListener() {
    let docRef: AngularFirestoreDocument<Customer>;

    this.afAuth.user
      .pipe(
        filter(user => !!user),
        switchMap(user => {
          docRef = this.afs.doc(
            `${FirestoreCollections.Customers}/${user.uid}`
          );
          return docRef.get({source: 'server'});
        }),
        take(1),
        takeUntil(this.destroyed$)
      )
      .subscribe(res => {
        this.validation[this.currentView](docRef, res);
      });
  }
}